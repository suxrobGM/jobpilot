import type { ReactElement } from "react";
import { Box, Link, Typography } from "@mui/material";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocsBlockquote, DocsCode, DocsPre, DocsTable } from "@/components/features/docs";

const listSx = { my: 0.5, pl: 3, "&:first-child": { mt: 0 }, "&:last-child": { mb: 0 } };

// Chat-sized: every block reads at body size, and headings only turn bold.
const heading: Components["h1"] = ({ node: _, ...props }) => (
  <Typography variant="body1Strong" component="p" sx={{ mt: 1.5, mb: 0.5 }} {...props} />
);

// `node` is react-markdown's AST handle; spreading it would land on the DOM element.
const COMPONENTS: Components = {
  p: ({ node: _, ...props }) => (
    <Typography
      variant="body1"
      sx={{ my: 1, "&:first-child": { mt: 0 }, "&:last-child": { mb: 0 } }}
      {...props}
    />
  ),
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  ul: ({ node: _, ...props }) => <Box component="ul" sx={listSx} {...props} />,
  ol: ({ node: _, ...props }) => <Box component="ol" sx={listSx} {...props} />,
  li: ({ node: _, ...props }) => (
    <Typography variant="body1" component="li" sx={{ my: 0.25 }} {...props} />
  ),
  a: ({ node: _, ...props }) => <Link {...props} />,
  code: ({ node: _, ...props }) => <DocsCode {...props} />,
  pre: ({ node: _, ...props }) => <DocsPre {...props} />,
  blockquote: ({ node: _, ...props }) => <DocsBlockquote {...props} />,
  table: ({ node: _, ...props }) => <DocsTable {...props} />,
};

interface MessageMarkdownProps {
  body: string;
}

/** A pilot reply as markdown; raw HTML stays text, since replies quote job postings. */
export function MessageMarkdown(props: MessageMarkdownProps): ReactElement {
  const { body } = props;
  return (
    <Box sx={{ overflowWrap: "anywhere" }}>
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {body}
      </Markdown>
    </Box>
  );
}

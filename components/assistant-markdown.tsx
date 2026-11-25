'use client';

import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const plugins = [remarkGfm];
const components: Components = {
  a({ node: _node, children, ...props }) {
    return (
      <a {...props} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ node: _node, children, ...props }) {
    return (
      <div className="assistant-markdown-table" tabIndex={0}>
        <table {...props}>{children}</table>
      </div>
    );
  },
};

// Scene heading updates must not reparse an unchanged assistant response.
export const AssistantMarkdown = memo(function AssistantMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="assistant-bubble answer assistant-markdown">
      <Markdown remarkPlugins={plugins} components={components} skipHtml>
        {content}
      </Markdown>
    </div>
  );
});

import { type Metadata } from "next";
import { generateStaticParamsFor, importPage } from "nextra/pages";

import { useMDXComponents as getMDXComponents } from "../../mdx-components";

const DOCS_PATH_SEGMENT = "docs";
const generateStaticParamsFromContent = generateStaticParamsFor("mdxPath");

function withDocsPath(pathSegments?: string[]) {
  const segments = pathSegments ?? [];
  return segments[0] === DOCS_PATH_SEGMENT
    ? segments
    : [DOCS_PATH_SEGMENT, ...segments];
}

export async function generateStaticParams() {
  const params = await generateStaticParamsFromContent();
  const seen = new Set<string>();
  const normalized: Array<{ mdxPath: string[] }> = [];

  for (const entry of params) {
    const segments = Array.isArray(entry.mdxPath) ? entry.mdxPath : [];
    const stripped =
      segments[0] === DOCS_PATH_SEGMENT ? segments.slice(1) : segments;
    const key = stripped.join("/");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push({ mdxPath: stripped });
  }

  return normalized;
}

export async function generateMetadata(props: {
  params: Promise<{ mdxPath?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const { metadata } = await importPage(withDocsPath(params.mdxPath));

  return metadata;
}

const Wrapper = getMDXComponents({}).wrapper!;

export default async function Page(props: {
  params: Promise<{ mdxPath?: string[] }>;
}) {
  const params = await props.params;
  const result = await importPage(withDocsPath(params.mdxPath));
  const { default: MDXContent, toc, metadata, sourceCode } = result;

  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}

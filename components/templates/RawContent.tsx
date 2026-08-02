/**
 * Render a stored content region.
 *
 * NOTE ON THE WRAPPER: the live pages place their content sections as direct
 * children of <body>, and dangerouslySetInnerHTML requires a host element, so
 * this adds one <div> the reference does not have. An earlier version unwrapped
 * that div on mount; it corrupted React's reconciliation ("removeChild: node is
 * not a child of this node") and tore the header and footer out of the DOM.
 *
 * The wrapper is kept instead, and verified by screenshot diff: the content
 * sections are block-level and full-width, so an unstyled block wrapper does not
 * change their layout. If a page ever proves otherwise, that page needs a real
 * structured template (as `course` already has) rather than a runtime DOM hack.
 */
export default function RawContent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

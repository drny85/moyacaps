import type React from "react";
import { render } from "@react-email/render";

export type RenderedEmail = { html: string; text: string };

/** Renders one email element to HTML and to its plain-text alternative (same source, two outputs). */
export async function renderEmail(element: React.ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

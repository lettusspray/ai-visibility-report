import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { ReportData } from "./types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.13, 0.15, 0.19);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.05, 0.53, 0.58);
const LINE = rgb(0.86, 0.88, 0.9);
const DEEP = rgb(0.11, 0.15, 0.22);

export type BrandingOptions = {
  whiteLabel: boolean;
  agencyName?: string | null;
  logo?: { bytes: Uint8Array; contentType: string } | null;
};

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  serif: PDFFont;
  serifBold: PDFFont;
  footer: string;
  pageNo: number;
};

function sanitize(text: string): string {
  return (text ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitize(text).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pageNo += 1;
  ctx.y = PAGE_H - MARGIN;
  ctx.page.drawText(sanitize(ctx.footer), {
    x: MARGIN,
    y: 32,
    size: 8,
    font: ctx.regular,
    color: MUTED,
  });
  ctx.page.drawText(String(ctx.pageNo), {
    x: PAGE_W - MARGIN - 10,
    y: 32,
    size: 8,
    font: ctx.regular,
    color: MUTED,
  });
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 30) newPage(ctx);
}

function text(
  ctx: Ctx,
  body: string,
  opts: {
    size?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    leading?: number;
    gap?: number;
    indent?: number;
  } = {},
) {
  const size = opts.size ?? 10.5;
  const font = opts.font ?? ctx.regular;
  const leading = opts.leading ?? size * 1.5;
  const indent = opts.indent ?? 0;
  for (const line of wrap(body, font, size, CONTENT_W - indent)) {
    ensure(ctx, leading);
    ctx.page.drawText(line, {
      x: MARGIN + indent,
      y: ctx.y - size,
      size,
      font,
      color: opts.color ?? INK,
    });
    ctx.y -= leading;
  }
  ctx.y -= opts.gap ?? 0;
}

function sectionHeading(ctx: Ctx, eyebrow: string, title: string) {
  ensure(ctx, 90);
  ctx.y -= 8;
  text(ctx, eyebrow.toUpperCase(), { size: 8, font: ctx.bold, color: ACCENT, leading: 14 });
  text(ctx, title, { size: 19, font: ctx.serifBold, leading: 26 });
  ensure(ctx, 16);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y - 2 },
    end: { x: PAGE_W - MARGIN, y: ctx.y - 2 },
    thickness: 1,
    color: LINE,
  });
  ctx.y -= 18;
}

function bar(ctx: Ctx, label: string, pct: number, highlight: boolean) {
  ensure(ctx, 34);
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  ctx.page.drawText(sanitize(label).slice(0, 42), {
    x: MARGIN,
    y: ctx.y - 10,
    size: 10,
    font: highlight ? ctx.bold : ctx.regular,
    color: INK,
  });
  const barX = MARGIN + 190;
  const barW = CONTENT_W - 230;
  ctx.page.drawRectangle({ x: barX, y: ctx.y - 12, width: barW, height: 9, color: rgb(0.93, 0.94, 0.95) });
  ctx.page.drawRectangle({
    x: barX,
    y: ctx.y - 12,
    width: (barW * value) / 100,
    height: 9,
    color: highlight ? ACCENT : rgb(0.66, 0.69, 0.73),
  });
  ctx.page.drawText(`${value}%`, {
    x: PAGE_W - MARGIN - 30,
    y: ctx.y - 11,
    size: 9.5,
    font: ctx.bold,
    color: highlight ? ACCENT : MUTED,
  });
  ctx.y -= 26;
}

export async function renderReportPdf(input: {
  report: ReportData;
  brandName: string;
  brandWebsite: string;
  industry: string;
  competitors: string[];
  questionCount: number;
  branding: BrandingOptions;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const publisher = input.branding.whiteLabel
    ? (input.branding.agencyName?.trim() || "Prepared by your agency")
    : "VisibilityAudit";

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
    regular,
    bold,
    serif,
    serifBold,
    footer: `${publisher}  |  AI Search Visibility Report  |  ${input.brandName}`,
    pageNo: 1,
  };

  // ---------- Cover ----------
  const cover = ctx.page;
  cover.drawRectangle({ x: 0, y: PAGE_H - 250, width: PAGE_W, height: 250, color: DEEP });
  cover.drawRectangle({ x: 0, y: PAGE_H - 254, width: PAGE_W, height: 4, color: ACCENT });

  let coverTextY = PAGE_H - 90;
  if (input.branding.logo) {
    try {
      const img = input.branding.logo.contentType.includes("png")
        ? await doc.embedPng(input.branding.logo.bytes)
        : await doc.embedJpg(input.branding.logo.bytes);
      const scaled = img.scaleToFit(150, 54);
      cover.drawImage(img, {
        x: MARGIN,
        y: PAGE_H - 60 - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      coverTextY = PAGE_H - 80 - scaled.height;
    } catch {
      /* ignore unusable logo */
    }
  }

  cover.drawText(sanitize(publisher.toUpperCase()).slice(0, 48), {
    x: MARGIN,
    y: coverTextY,
    size: 9,
    font: bold,
    color: rgb(0.62, 0.78, 0.8),
  });
  cover.drawText("AI Search Visibility Report", {
    x: MARGIN,
    y: coverTextY - 44,
    size: 28,
    font: serifBold,
    color: rgb(1, 1, 1),
  });
  cover.drawText(sanitize(input.brandName).slice(0, 44), {
    x: MARGIN,
    y: coverTextY - 76,
    size: 16,
    font: regular,
    color: rgb(0.78, 0.84, 0.87),
  });

  ctx.y = PAGE_H - 300;
  text(ctx, "PREPARED FOR", { size: 8, font: bold, color: ACCENT, leading: 16 });
  text(ctx, `${input.brandName} - ${input.brandWebsite}`, { size: 12, font: serifBold, gap: 12 });
  text(ctx, "SCOPE", { size: 8, font: bold, color: ACCENT, leading: 16 });
  text(
    ctx,
    `${input.questionCount} buyer-intent questions in ${input.industry}, tested across ChatGPT (OpenAI), Google Gemini and Perplexity.`,
    { gap: 12 },
  );
  text(ctx, "COMPETITIVE SET", { size: 8, font: bold, color: ACCENT, leading: 16 });
  text(ctx, input.competitors.join(", ") || "n/a", { gap: 12 });
  text(ctx, "DATE", { size: 8, font: bold, color: ACCENT, leading: 16 });
  text(ctx, input.generatedAt.toISOString().slice(0, 10));

  cover.drawText(sanitize(ctx.footer), { x: MARGIN, y: 32, size: 8, font: regular, color: MUTED });

  // ---------- Executive summary ----------
  newPage(ctx);
  sectionHeading(ctx, "01", "Executive summary");
  text(ctx, input.report.executiveSummary, { leading: 16, gap: 16 });

  text(ctx, "Share of AI answers mentioning each brand", { size: 11, font: bold, gap: 10 });
  bar(ctx, input.brandName, input.report.brandVisibility, true);
  for (const c of input.report.competitorVisibility) bar(ctx, c.name, c.visibility, false);

  // ---------- Platform breakdown ----------
  newPage(ctx);
  sectionHeading(ctx, "02", "Platform breakdown");
  for (const platform of input.report.platforms) {
    ensure(ctx, 120);
    text(ctx, platform.platform, { size: 13, font: serifBold, gap: 4 });
    bar(ctx, `${input.brandName} visibility`, platform.brandVisibility, true);
    for (const c of platform.competitorVisibility) bar(ctx, c.name, c.visibility, false);
    text(ctx, platform.summary, { leading: 15, gap: 8 });
    for (const ex of platform.exampleExcerpts.slice(0, 2)) {
      ensure(ctx, 60);
      text(ctx, `Q: ${ex.question}`, { size: 9.5, font: bold, color: MUTED, indent: 12, leading: 14 });
      text(ctx, `"${ex.excerpt}"`, { size: 9.5, font: ctx.serif, indent: 12, leading: 14, gap: 6 });
    }
    ctx.y -= 8;
  }

  // ---------- Why you're losing ----------
  newPage(ctx);
  sectionHeading(ctx, "03", "Why you are losing these answers");
  for (const point of input.report.whyLosing) {
    ensure(ctx, 40);
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 12, width: 3, height: 10, color: ACCENT });
    text(ctx, point, { indent: 14, leading: 15, gap: 10 });
  }

  // ---------- Action items ----------
  newPage(ctx);
  sectionHeading(ctx, "04", "Prioritised action plan");
  input.report.actionItems.forEach((item, i) => {
    ensure(ctx, 90);
    text(ctx, `${i + 1}. ${item.title}`, { size: 12, font: bold, gap: 2 });
    text(ctx, item.detail, { leading: 15, indent: 14, gap: 4 });
    text(ctx, `Expected impact: ${item.impact}`, {
      size: 9.5,
      font: ctx.serif,
      color: MUTED,
      indent: 14,
      gap: 12,
    });
  });

  // ---------- Closing ----------
  newPage(ctx);
  sectionHeading(ctx, "05", "What happens next");
  text(ctx, input.report.closingNote, { leading: 16, gap: 18 });
  text(ctx, "Methodology", { size: 11, font: bold, gap: 6 });
  text(
    ctx,
    `Each of the ${input.questionCount} buyer-intent questions was submitted to OpenAI, Google Gemini and Perplexity. Every answer was scanned for mentions of ${input.brandName} and of each competitor. Visibility percentages are the share of answers on that platform in which the brand appears. AI answers vary between runs; treat these figures as a directional benchmark to re-measure over time.`,
    { size: 9.5, leading: 14, color: MUTED, gap: 18 },
  );
  text(ctx, `Prepared by ${publisher}.`, { size: 10, font: bold });

  return doc.save();
}
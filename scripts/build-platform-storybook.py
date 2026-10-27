"""Build the picturebook with ReportLab; preserve source image pixels.

Use bundled Python. A final build requires current, captioned screen evidence.
--draft omits screen pages and writes a clearly marked layout review PDF.
"""
from pathlib import Path
import argparse
import hashlib
import json

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "docs/storybook"
W, H = 612, 792
INK, GREEN, PALE, MUTED = [HexColor(c) for c in ("#173C2B", "#236E46", "#ECF5EB", "#53695C")]
ART = BASE / "images/luma-story-six-scenes.png"


def paragraph(c, text, x, top, width, size=21, color=INK, bold=False):
    style = ParagraphStyle("book", fontName="BookBold" if bold else "Book", fontSize=size,
                           leading=size * 1.32, textColor=color, spaceAfter=0)
    text = text.replace("&", "&amp;").replace("\n", "<br/>")
    p = Paragraph(text, style)
    _, height = p.wrap(width, H)
    p.drawOn(c, x, top - height)
    return top - height


def panel(c, index, x, y, size):
    # PDF clipping selects a panel. The original image file is never cropped or edited.
    # Source art: 1024 x 1536; the six scene interiors exclude the white gutters.
    bounds = [(0, 0, 505, 491), (519, 0, 1024, 491), (0, 505, 505, 994),
              (519, 505, 1024, 994), (0, 1008, 505, 1536), (519, 1008, 1024, 1536)]
    left, top, right, bottom = bounds[index]
    scale = max(size / (right-left), size / (bottom-top))
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, size, size, 16)
    c.clipPath(p, stroke=0)
    # Transform uses image bottom-left coordinates; center the selected panel.
    dx = x + (size-(right-left)*scale)/2 - left*scale
    dy = y + (size-(bottom-top)*scale)/2 - (1536-bottom)*scale
    c.drawImage(str(ART), dx, dy, 1024*scale, 1536*scale)
    c.restoreState()


def box(c, text, x, y, width, height, size=18):
    c.setFillColor(PALE)
    c.roundRect(x, y, width, height, 12, fill=1, stroke=0)
    paragraph(c, text, x+15, y+height-15, width-30, size, bold=True)


def arrow(c, x1, y1, x2, y2):
    c.setStrokeColor(GREEN)
    c.setFillColor(GREEN)
    c.setLineWidth(2)
    c.line(x1, y1, x2, y2)
    import math
    angle = math.atan2(y2-y1, x2-x1)
    p = c.beginPath()
    p.moveTo(x2, y2)
    for a in (angle+2.6, angle-2.6):
        p.lineTo(x2+9*math.cos(a), y2+9*math.sin(a))
    p.close()
    c.drawPath(p, fill=1, stroke=0)


def diagram(c, kind):
    if kind == "issues":
        for text, x in [("Keep\nevidence", 44), ("Ask for\nreview", 224), ("Record the\nnext step", 404)]:
            box(c, text, x, 259, 164, 90)
        arrow(c, 210, 304, 222, 304)
        arrow(c, 390, 304, 402, 304)
        box(c, "Material return", 64, 142, 225, 62)
        box(c, "Money review", 323, 142, 225, 62)
        paragraph(c, "Two separate paths. Both need evidence.", 64, 120, 490, 17, MUTED)
    elif kind == "privacy":
        for label, desc, y in [("Owner", "Checks receipt + payment", 320),
                               ("Invited adult helper", "Helps with handover", 219),
                               ("Report reader", "Sees only the shared report", 118)]:
            box(c, label, 54, y, 504, 82, 21)
            paragraph(c, desc, 69, y+36, 470, 17, MUTED)
    else:
        entries = [("Household", "Ask + hand over", 44, 330),
                   ("Shop + Saathi", "Collect + weigh", 324, 330),
                   ("Centre + yard", "Receive + sort", 44, 213),
                   ("Plant + maker", "Process + make", 324, 213)]
        for title, sub, x, y in entries:
            box(c, title, x, y, 244, 86, 21)
            paragraph(c, sub, x+15, y+36, 214, 17, MUTED)
        arrow(c, 291, 373, 321, 373)
        arrow(c, 446, 328, 166, 301)
        arrow(c, 291, 256, 321, 256)
        box(c, "Admin, support, partners and reviewers help\nwith the records they are allowed to see.", 44, 101, 524, 80, 18)


def screenshot_detail(c, path, screen, bottom):
    """Show a labelled detail using PDF clipping; preserve screenshot pixels."""
    reader = ImageReader(str(path))
    iw, ih = reader.getSize()
    crop = screen.get("detail", {"left": 0, "top": 0, "width": iw, "height": ih})
    left, top, width, height = (crop[k] for k in ("left", "top", "width", "height"))
    if min(left, top) < 0 or min(width, height) <= 0 or left + width > iw or top + height > ih:
        raise ValueError(f"Invalid screenshot detail: {path.name}")
    avail_h = bottom - 121
    if avail_h < 120:
        raise ValueError(f"Too little screenshot space: {path.name}")
    scale = min(524 / width, avail_h / height)
    sw, sh = width * scale, height * scale
    x, y = (W - sw) / 2, 102 + (avail_h - sh) / 2
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, sw, sh)
    c.clipPath(clip, stroke=0)
    c.drawImage(reader, x - left * scale, y - (ih - top - height) * scale,
                iw * scale, ih * scale)
    c.restoreState()
    c.setStrokeColor(HexColor("#D6E3D7"))
    c.roundRect(x-1, y-1, sw+2, sh+2, 4, fill=0, stroke=1)
    paragraph(c, screen["caption"], 44, 85, 524, 11, MUTED)
    return crop


def build(draft):
    pdfmetrics.registerFont(TTFont("Book", "/System/Library/Fonts/Supplemental/Arial.ttf"))
    pdfmetrics.registerFont(TTFont("BookBold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
    story = json.loads((BASE / "story.json").read_text())
    manifest = json.loads((BASE / "screenshots.json").read_text())
    pages = story["pages"]
    if len(pages) != 16:
        raise ValueError("The story must keep its sixteen-page format")
    for page in pages:
        if page["kind"] not in ("cover", "notes") and len(page["text"].split()) >= 60:
            raise ValueError(f"Story scene is too long: {page['title']}")
    if draft:
        pages = [p for p in pages if p["kind"] != "screen"]
        out = BASE / "review/layout-draft.pdf"
    else:
        if manifest["status"] != "verified_current_release":
            raise ValueError("Final build blocked: current release screenshots are not verified")
        for key, screen in manifest["screens"].items():
            if not screen["path"] or not (ROOT / screen["path"]).is_file():
                raise ValueError(f"Missing screenshot: {key}")
            if not screen["caption"] or not screen["evidence"]:
                raise ValueError(f"Missing evidence label: {key}")
            digest = hashlib.sha256((ROOT / screen["path"]).read_bytes()).hexdigest()
            if screen.get("sha256") != digest:
                raise ValueError(f"Screenshot changed after review: {key}")
        capture_manifest = ROOT / manifest["captureManifest"]
        if hashlib.sha256(capture_manifest.read_bytes()).hexdigest() != manifest["captureManifestSha256"]:
            raise ValueError("Capture evidence changed after approval")
        capture_evidence = json.loads(capture_manifest.read_text())
        if capture_evidence.get("status") != "approved-isolated-current-components-subset":
            raise ValueError("An approved selected-image receipt is required")
        approved = {entry["file"]: entry for entry in capture_evidence["captures"]}
        for screen in manifest["screens"].values():
            entry = approved.get(Path(screen["path"]).name)
            if not entry or entry.get("visualReview") != "passed" or entry["screenshotSha256"] != screen["sha256"]:
                raise ValueError("A selected screenshot lacks exact visual approval")
        for source, digest in capture_evidence["sourceHashes"].items():
            if hashlib.sha256((ROOT / source).read_bytes()).hexdigest() != digest:
                raise ValueError(f"App source changed after capture: {source}")
        out = ROOT / "output/pdf/luma-green-platform-storybook.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(out), pagesize=(W, H), pageCompression=1)
    c.setTitle(story["title"])
    c.setAuthor("Luma.Green")
    c.setSubject("A short fictional story with separately labelled app screen evidence")
    audit = []
    for i, page in enumerate(pages, 1):
        c.setFillColor(white)
        c.rect(0, 0, W, H, fill=1, stroke=0)
        paragraph(c, "LUMA.GREEN  /  A LITTLE STORY", 44, 758, 520, 11, GREEN, True)
        if page["kind"] == "cover":
            paragraph(c, page["title"], 44, 714, 524, 44, bold=True)
            paragraph(c, page["text"], 44, 584, 524, 19)
            panel(c, 0, 116, 116, 380)
            paragraph(c, "Meet Bobo, Mira and the people who help material move.", 60, 90, 490, 16, MUTED)
        else:
            y = paragraph(c, page["title"], 44, 710, 524, 31, bold=True)
            size = 17 if page["kind"] == "notes" else 21
            bottom = paragraph(c, page["text"], 44, y-19, 524, size)
            if page["kind"] == "art":
                img_size = min(352, bottom-108)
                panel(c, page["panel"], (W-img_size)/2, 92, img_size)
            elif page["kind"] == "screen":
                screen = manifest["screens"][page["screen"]]
                path = ROOT / screen["path"]
                crop = screenshot_detail(c, path, screen, bottom)
                audit.append({"page":i,"screenshot":str(path.relative_to(ROOT)),
                              "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                              "caption":screen["caption"],"evidence":screen["evidence"], "detail":crop})
            elif page["kind"] == "diagram":
                if bottom < 425:
                    raise ValueError(f"Text overlaps diagram on page {i}: {bottom}")
                diagram(c, page["diagram"])
            elif page["kind"] == "notes":
                panel(c, 5, 236, 83, 140)
            if page.get("tag"):
                paragraph(c, page["tag"], 44, 52, 515, 9, GREEN, True)
        c.setFillColor(MUTED)
        c.setFont("Book", 10)
        c.drawRightString(569, 26, str(i))
        if draft:
            c.setFont("BookBold", 9)
            c.drawString(44, 26, "LAYOUT DRAFT - APP SCREEN PAGES OMITTED")
        c.showPage()
    c.save()
    (BASE / "review/build-audit.json").write_text(json.dumps({"draft":draft,"pages":len(pages),
        "output":str(out),"screenshots":audit}, indent=2)+"\n")
    print(out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--draft", action="store_true")
    build(parser.parse_args().draft)

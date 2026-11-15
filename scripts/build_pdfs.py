#!/usr/bin/env python3
"""Build one complete hosted PDF per activity (reportlab, arabic-reshaper, python-bidi)."""

import json
import sys
from functools import lru_cache
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'pdfs'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
SECTIONS = (
    ('general', 'الاشتراطات العامة المناسبة للنشاط'),
    ('specific', 'الاشتراطات الخاصة بالنشاط'),
    ('operations', 'الممارسات والإجراءات التشغيلية المناسبة للنشاط'),
)
PAGE_W, PAGE_H = A4
LEFT, RIGHT, BOTTOM = 51, PAGE_W - 51, 56
TEXT_W = RIGHT - LEFT


@lru_cache(maxsize=100000)
def shaped(value):
    return get_display(arabic_reshaper.reshape(value))


class Document:
    def __init__(self, path):
        self.pdf = canvas.Canvas(str(path), pagesize=A4, pageCompression=1)
        self.page = 0
        self.new_page()

    def new_page(self):
        if self.page:
            self.pdf.showPage()
        self.page += 1
        p = self.pdf
        p.setStrokeColor(HexColor('#7e153a'))
        p.setLineWidth(2.1)
        p.rect(17, 17, PAGE_W - 34, PAGE_H - 34)
        p.setStrokeColor(HexColor('#be9747'))
        p.setLineWidth(.7)
        p.rect(22, 22, PAGE_W - 44, PAGE_H - 44)
        self.y = PAGE_H - 53

    def room(self, points):
        if self.y - points < BOTTOM:
            self.new_page()

    def line(self, content, size, color, leading):
        current = ''
        lines = []
        for word in content.split():
            candidate = f'{current} {word}'.strip()
            if current and pdfmetrics.stringWidth(shaped(candidate), 'Arabic', size) > TEXT_W:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        for text in lines:
            self.room(leading)
            self.pdf.setFillColor(HexColor(color))
            self.pdf.setFont('Arabic', size)
            self.pdf.drawRightString(RIGHT, self.y - size, shaped(text))
            self.y -= leading

    def heading(self, content, level):
        if level == 2:
            self.room(60)
            self.y -= 12
            self.line(content, 14.5, '#164f3c', 27)
            self.pdf.setStrokeColor(HexColor('#cadbd1'))
            self.pdf.setLineWidth(.7)
            self.pdf.line(LEFT, self.y + 2, RIGHT, self.y + 2)
            self.y -= 8
        else:
            self.room(45)
            self.y -= 7
            self.line(content, 11.2, '#244e40', 20)

    def paragraph(self, content):
        # Wrap logical words, then reshape each line for correct Arabic ligatures and direction.
        size, leading = 10.4, 16.4
        self.y -= 4
        for segment in content.split('\n'):
            current = ''
            for word in segment.split():
                candidate = f'{current} {word}'.strip()
                if current and pdfmetrics.stringWidth(shaped(candidate), 'Arabic', size) > TEXT_W:
                    self.line(current, size, '#14241e', leading)
                    current = word
                else:
                    current = candidate
            if current:
                self.line(current, size, '#14241e', leading)
        self.y -= 2

    def blocks(self, items):
        for block in items:
            if block['kind'] == 'heading':
                self.heading(block['text'], 3)
            else:
                self.paragraph(block['text'])

    def finish(self):
        self.pdf.save()
        return self.page


def build(item):
    path = OUT / f'{item["id"]}.pdf'
    doc = Document(path)
    p = doc.pdf
    p.drawImage(ImageReader(str(ROOT / 'assets' / 'municipality-aldaayen.png')),
                LEFT, doc.y - 59, width=93, height=59, preserveAspectRatio=True, anchor='c', mask='auto')
    p.drawImage(ImageReader(str(ROOT / 'assets' / 'qatar-ministry.png')),
                RIGHT - 93, doc.y - 59, width=93, height=59, preserveAspectRatio=True, anchor='c', mask='auto')
    doc.y -= 70
    p.setStrokeColor(HexColor('#d8c79c'))
    p.setLineWidth(.8)
    p.line(LEFT, doc.y, RIGHT, doc.y)
    doc.y -= 17
    doc.line(item['title'], 20, '#701334', 34)
    doc.line('اشتراطات المنشآت الغذائية', 10, '#445b50', 21)
    doc.y -= 10
    doc.blocks([
        {**block, 'text': block['text'].split('المصدر الرسمي:')[0].rstrip()}
        for block in item['intro'] if not block['text'].lstrip().startswith('المصدر')
    ])
    for key, label in SECTIONS:
        doc.heading(label, 2)
        doc.blocks(item[key])
    return path, doc.finish()


def main():
    pdfmetrics.registerFont(TTFont('Arabic', FONT))
    items = json.loads((ROOT / 'assets' / 'requirements.json').read_text())['items']
    if len(sys.argv) == 2:
        items = [item for item in items if item['id'] == sys.argv[1]]
        if not items:
            raise SystemExit('Unknown activity ID')
    OUT.mkdir(exist_ok=True)
    for index, item in enumerate(items, 1):
        path, pages = build(item)
        print(f'{index}/{len(items)} {path.name}: {pages} pages, {path.stat().st_size:,} bytes', flush=True)


if __name__ == '__main__':
    main()

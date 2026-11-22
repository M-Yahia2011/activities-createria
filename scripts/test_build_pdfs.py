import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from unicodedata import normalize

import build_pdfs


class PdfProtectionTests(unittest.TestCase):
    def test_bulk_uses_only_unreserved_generated_names(self):
        laundry = dict(id='30-غسيل-الملابس-الآلي')
        aliases = [laundry, dict(id=normalize('NFD', laundry['id']))]
        items = [
            dict(id='generated'),
            *aliases,
            dict(id='salon', documentOnly=True),
            dict(id='other', pdfFile='supplied.pdf'),
            dict(id='supplied'),  # Its generated path would clobber other.pdfFile.
        ]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'assets').mkdir()
            (root / 'assets/requirements.json').write_text(json.dumps({'items': items}))
            out = root / 'pdfs'
            out.mkdir()
            originals = {
                'supplied.pdf': b'user supplied',
                'salon.pdf': b'official document',
                f'{laundry["id"]}.pdf': b'prepared laundry document',
            }
            for name, contents in originals.items():
                (out / name).write_bytes(contents)

            def fake_build(item):
                path = out / f'{item["id"]}.pdf'
                path.write_bytes(b'generated')
                return path, 1

            with (
                patch.object(build_pdfs, 'ROOT', root),
                patch.object(build_pdfs, 'OUT', out),
                patch.object(build_pdfs, 'TTFont'),
                patch.object(build_pdfs.pdfmetrics, 'registerFont'),
                patch.object(build_pdfs, 'build', side_effect=fake_build) as build,
                patch.object(sys, 'argv', ['build_pdfs.py']),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                build_pdfs.main()
                build.assert_called_once_with(items[0])
            self.assertEqual((out / 'generated.pdf').read_bytes(), b'generated')
            for name, contents in originals.items():
                self.assertEqual((out / name).read_bytes(), contents)
            self.assertFalse((out / 'other.pdf').exists())

    def test_single_protected_report_exits_before_writing(self):
        items = json.loads(
            (build_pdfs.ROOT / 'assets/requirements.json').read_text(encoding='utf-8')
        )['items']
        protected = [item['id'] for item in items if build_pdfs.source_authored(item)]
        self.assertTrue(
            (build_pdfs.AUTHORED_PDF_IDS | {'men-salons', 'women-salons'}).issubset(protected)
        )
        with patch.object(build_pdfs, 'TTFont') as font, patch.object(build_pdfs, 'build') as build:
            for activity_id in protected:
                with self.subTest(activity_id=activity_id):
                    with patch.object(sys, 'argv', ['build_pdfs.py', activity_id]):
                        with self.assertRaisesRegex(SystemExit, 'source-authored'):
                            build_pdfs.main()
            font.assert_not_called()
            build.assert_not_called()


if __name__ == '__main__':
    unittest.main()

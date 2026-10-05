"""Import fidèle du classeur, sans dépendance Python externe."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def extract(path):
    with zipfile.ZipFile(path) as archive:
        strings = [''.join(t.text or '' for t in item.findall('.//s:t', NS))
                   for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        def sheet(number):
            result = []
            for row in ET.fromstring(archive.read(f'xl/worksheets/sheet{number}.xml')).findall('.//s:row', NS):
                values = {}
                for cell in row.findall('s:c', NS):
                    value = cell.find('s:v', NS)
                    text = value.text if value is not None else ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                    if cell.get('t') == 's': text = strings[int(text)]
                    values[re.sub(r'\d', '', cell.get('r'))] = text or ''
                result.append(values)
            return result
        corrections = {int(r['A']): r for r in sheet(2) if r.get('A', '').isdigit()}
        questions = []
        for r in sheet(1):
            if not r.get('A', '').isdigit(): continue
            position = int(r['A'])
            correction = corrections[position]
            assert correction['B'] == r['B'] and correction['C'] == r['C'], f'Question {position} incohérente'
            correct = correction['D'].lower()
            assert correct in 'abcd' and len(correct) == 1
            options = [{'id': letter, 'label': r[column]} for letter, column in zip('abcd', 'DEFG')]
            assert options['abcd'.index(correct)]['label'] == correction['E'], f'Correction {position} incohérente'
            assert correction['F'] and all(o['label'] for o in options)
            questions.append(dict(position=position, module=r['B'], text=r['C'], options=options,
                                  correct=correct, explanation=correction['F'], points=1))
        assert questions and len(questions) == len(corrections)
        assert len({q['position'] for q in questions}) == len(questions)
        note = next(s for s in strings if s.startswith('Barème :'))
        assert '70 %' in note and '50 %' in note and '1 point' in note, 'Barème modifié : adapter explicitement les seuils'
        metadata = dict(title='QCM — Formation assurance vie', durationMinutes=30, passingRatio=.7,
                        consolidationRatio=.5, source=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                        notation=note, count=len(questions), maxScore=sum(q['points'] for q in questions))
        return questions, metadata

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook', nargs='?', default=str(ROOT / 'source/QCM_formation_assurance_vie.xlsx'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    questions, metadata = extract(Path(args.workbook))
    for name, data in [('questions.json', questions), ('metadata.json', metadata)]:
        target = ROOT / 'db' / name
        if args.check:
            assert json.loads(target.read_text(encoding='utf-8')) == data, f'{name} diffère du classeur'
        else:
            target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(questions)} questions et corrections vérifiées ; {metadata["maxScore"]} points.')

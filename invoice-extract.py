import sys,os,json,subprocess,tempfile,csv,io,re
from pathlib import Path
path=Path(sys.argv[1]);kind=sys.argv[2]
MAX_PAGES=5

def ocr_image(image):
    from PIL import Image
    with Image.open(image) as im:
        if im.width*im.height>25000000:raise ValueError('Use an image smaller than 25 megapixels.')
        im.verify()
    out=subprocess.run(['tesseract',str(image),'stdout','--tessdata-dir',str(Path(__file__).parent/'vendor'/'ocr'),'-l','eng+heb','--psm','6','-c','tessedit_create_tsv=1'],capture_output=True,text=True,timeout=40)
    if out.returncode:raise ValueError('The image could not be read. Try a clearer photo.')
    if not re.search('[\u0590-\u05ff]',out.stdout):
        english=subprocess.run(['tesseract',str(image),'stdout','--tessdata-dir',str(Path(__file__).parent/'vendor'/'ocr'),'-l','eng','--psm','6','-c','preserve_interword_spaces=1'],capture_output=True,text=True,timeout=40)
        if english.returncode:raise ValueError('The image could not be read. Try a clearer photo.')
        return english.stdout
    rows={}
    for w in csv.DictReader(io.StringIO(out.stdout),delimiter='\t'):
        if w.get('level')!='5' or not w.get('text','').strip():continue
        key=(w['page_num'],w['block_num'],w['par_num'],w['line_num'])
        rows.setdefault(key,[]).append(w)
    result=[]
    for words in rows.values():
        groups=[]
        row_height=max(int(w['height']) for w in words)
        for w in sorted(words,key=lambda w:int(w['left'])):
            if not groups or int(w['left'])-int(groups[-1][-1]['left'])-int(groups[-1][-1]['width'])>row_height*0.8:groups.append([])
            groups[-1].append(w)
        cells=[]
        for group in groups:
            text=' '.join(w['text'] for w in group)
            if len(re.findall('[\u0590-\u05ff]',text))>len(re.findall('[a-zA-Z]',text)):group.reverse()
            cells.append(' '.join(w['text'].replace('\u200e','').replace('\u200f','') for w in group))
        result.append('  '.join(cells))
    return '\n'.join(result)

try:
    pages=[];table_rows=[];method='text';notes=[]
    if kind=='application/pdf':
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            if len(pdf.pages)>MAX_PAGES:raise ValueError('Upload at most five invoice pages at a time.')
            for i,page in enumerate(pdf.pages):
                text=page.extract_text(layout=True) or ''
                for table in page.extract_tables():
                    header=None
                    for cells in table:
                        values=[str(c or '').strip() for c in cells]
                        lowered=[v.lower() for v in values]
                        if any(v in ('qty','quantity','aantal','כמות') for v in lowered) and any(v in ('description','title','omschrijving','תיאור','שם הספר','פריט') for v in lowered):
                            active=[j for j,v in enumerate(values) if v]
                            header=active
                            table_rows.append('  '.join(values[j] for j in active))
                            continue
                        if header is None:continue
                        chosen=[values[j] for j in header]
                        if not any(chosen):continue
                        # Preserve complete multi-line descriptions for one item, and aligned rows for multiple items.
                        parts=[value.splitlines() or [''] for value in chosen]
                        qindex=next((k for k,value in enumerate(parts) if all(v.replace('.','',1).isdigit() for v in value) and len(value)>1),None)
                        count=len(parts[qindex]) if qindex is not None else 1
                        if count>1 and any(len(part) not in (1,count) for part in parts):
                            notes.append('A multi-line table row needs review against the original invoice.')
                            continue
                        for row_index in range(count):
                            table_rows.append('  '.join((' '.join(part) if count==1 else part[row_index] if len(part)==count else part[0]) for part in parts))
                if len(text.strip())>=50:
                    pages.append(text)
                else:
                    method='ocr'
                    with tempfile.TemporaryDirectory(prefix='invoice-page-') as folder:
                        prefix=str(Path(folder)/'page')
                        result=subprocess.run(['pdftoppm','-f',str(i+1),'-l',str(i+1),'-scale-to','2200','-png','-singlefile',str(path),prefix],capture_output=True,timeout=30)
                        if result.returncode:raise ValueError('A scanned PDF page could not be read. Try a clearer scan.')
                        pages.append(ocr_image(prefix+'.png'))
    else:
        method='ocr';pages=[ocr_image(path)]
    text='\n\n'.join(pages)
    if len(text)>1000000:raise ValueError('The extracted invoice is too large. Split it into smaller files.')
    if method=='ocr':notes.append('OCR was used. Check codes, titles and quantities against the original invoice.')
    print(json.dumps({'text':text,'method':method,'warnings':notes,'tableText':'\n'.join(table_rows)},ensure_ascii=False))
except subprocess.TimeoutExpired:
    print(json.dumps({'error':'Reading this invoice took too long. Try fewer pages or a clearer image.'}));sys.exit(1)
except Exception as e:
    print(json.dumps({'error':str(e)[:250]}));sys.exit(1)

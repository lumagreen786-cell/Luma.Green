from pathlib import Path
import json, math, hashlib, textwrap
from urllib.parse import urlparse
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT=Path.cwd()
PUBLIC=ROOT/'docs/delivery/evidence/ship-x-redo-public-2026-11-11'
PROTECTED=ROOT/'docs/delivery/evidence/ship-x-redo-2026-11-11'
OUT=ROOT/'output/pdf/Luma-Green-Ship-X-Redesign-Review.pdf'
FOREST=HexColor('#144419');GREEN=HexColor('#317F38');LIME=HexColor('#A8E665');YELLOW=HexColor('#EBFF00');WHITE=HexColor('#FFFFFF');PALE=HexColor('#EEF2EF')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def clean(s):return str(s).replace('\u2014','-').replace('\u2013','-').encode('ascii','replace').decode()
pub=json.loads((PUBLIC/'manifest.json').read_text());prot=json.loads((PROTECTED/'layout-manifest.json').read_text())
assert pub.get('finishedAt'), 'Public capture pass must finish before authoring'
assert pub.get('passed') is True, 'Public capture checks must pass before authoring'
assert prot.get('passed') is True, 'Protected capture checks must pass before authoring'
assert prot.get('finishedAt'), 'Protected capture pass must finish before authoring'
assert prot.get('sourceUnchanged') is True, 'Protected sources changed during capture'
entries=[]
for c in pub['captures']:
 entries.append(dict(c,path=PUBLIC/c['file'],kind='solar' if 'solar-example' in c['file'] else 'public'))
legacy_routes={'/en/sell/basket','/en/sell/shop','/en/sell/when'}
example_routes={'/en/app/finance-example','/en/app/intake-example','/en/login/factor'}
for c in prot['captures']:
 if c.get('passed'):
  route=c['route'].split('?')[0]
  kind='legacy' if route in legacy_routes else 'example' if route in example_routes else 'seeded'
  entries.append(dict(c,path=PROTECTED/c['file'],kind=kind))
entries.sort(key=lambda c: {'public':0,'solar':1,'seeded':2,'example':3,'legacy':4}[c['kind']])
assert entries and all(c['path'].exists() for c in entries)
for i,c in enumerate(entries,1):
 c['number']=i
 with Image.open(c['path']) as im:w,h=im.size
 c['imageSize']=[w,h];c['scale']=min(1.0,1152/w)
 # Never compress an entire long screen to fit. Segment at readable scale,
 # with 32 original pixels repeated so a line at a split remains visible.
 maxh=int(1380/c['scale']); segments=[];top=0
 while top<h:
  bottom=min(h,top+maxh);segments.append((top,bottom))
  if bottom==h:break
  top=bottom-32
 c['segments']=segments
 c['label']={'public':'ACTUAL DISCONNECTED UI','solar':'SYNTHETIC LOCAL ESTIMATE','seeded':'SEEDED REVIEW FIXTURE','example':'STANDALONE COMPONENT EXAMPLE','legacy':'LEGACY COMPONENT EXAMPLE - NOT CURRENT BOOKING FLOW'}[c['kind']]
 c['title']=clean(c['route'])
 if c.get('redirected') and c.get('finalURL'):c['title']+=' -> '+urlparse(c['finalURL']).path
 if 'solar-example-chart' in c['file']:c['title']+=' (chart detail)'
rows_per_page=24;contents_pages=math.ceil(len(entries)/rows_per_page);nextpage=3+contents_pages
for c in entries:c['startPage']=nextpage;nextpage+=len(c['segments'])
total=nextpage-1
OUT.parent.mkdir(parents=True, exist_ok=True)
(ROOT/'tmp/pdfs').mkdir(parents=True, exist_ok=True)
pdf=canvas.Canvas(str(OUT),pagesize=(960,640),pageCompression=1)
pdf.setTitle('Luma.Green - Ship X Redesign Review')
pdf.setAuthor('Luma.Green')
pdf.setSubject('Current interface review: disconnected public screens and isolated seeded fixtures')
page_no=0

def text(x,y,s,size=11,bold=False,color=FOREST):
 pdf.setFillColor(color);pdf.setFont('Helvetica-Bold' if bold else 'Helvetica',size);pdf.drawString(x,y,clean(s))
def lines(x,y,s,width=100,size=11,leading=16,color=FOREST):
 for line in textwrap.wrap(clean(s),width=width):text(x,y,line,size,color=color);y-=leading
 return y
def footer(w,h,context='UI review only - no production or physical-device acceptance'):
 pdf.setStrokeColor(PALE);pdf.line(32,38,w-32,38)
 text(32,23,context,8)
 pdf.setFont('Helvetica',8);pdf.drawRightString(w-32,23,f'{page_no} / {total}')
def newpage(w,h):
 global page_no
 if page_no:pdf.showPage()
 page_no+=1;pdf.setPageSize((w,h));pdf.setFillColor(WHITE);pdf.rect(0,0,w,h,fill=1,stroke=0)

# Cover
newpage(960,640);pdf.bookmarkPage('cover');pdf.addOutlineEntry('Luma.Green UI review','cover',0)
pdf.setFillColor(FOREST);pdf.rect(0,0,960,640,fill=1,stroke=0)
text(48,582,'LUMA.GREEN',18,True,WHITE)
pdf.setFillColor(LIME);pdf.roundRect(48,510,190,28,14,fill=1,stroke=0);text(64,519,'DESIGN REVIEW / 11 NOV 2026',9,True)
text(48,435,'Cleaner tomorrow.',48,True,WHITE);text(48,376,'A clearer interface.',48,True,WHITE)
lines(48,312,'Ship X-inspired screens across public pages, household tools, account settings, business workspaces and administration.',width=80,size=16,leading=23,color=WHITE)
text(48,205,f'{len(entries)} captures',28,True,LIME);text(300,205,f'{total} review pages',28,True,LIME)
text(48,165,'Light-only palette. Real components. Clearly labelled sample states.',14,color=WHITE)
for x,col in zip([48,112,176,240,304],[YELLOW,LIME,GREEN,FOREST,WHITE]):
 pdf.setFillColor(col);pdf.setStrokeColor(WHITE);pdf.roundRect(x,88,48,48,12,fill=1,stroke=1)
text(48,50,'Screenshots for design review - not a live transaction or release certificate.',10,color=WHITE)

# Evidence key and scope
newpage(960,960);pdf.bookmarkPage('scope');pdf.addOutlineEntry('How to read this review','scope',0)
text(40,906,'How to read this review',28,True)
y=860
for label,body in [
 ('ACTUAL DISCONNECTED UI','Public pages and empty forms from the recorded local production build. Services without a connection show their real unavailable state. A private activity route redirects to login; the screenshot proves that gate, not private activity access.'),
 ('SEEDED REVIEW FIXTURE','Current protected components with isolated synthetic records. These captures show role-specific screen composition, tasks and navigation. They do not prove real sign-in, permitted record access, paid provider calls or production records.'),
 ('STANDALONE COMPONENT EXAMPLE','Finance, intake and factor examples are isolated components. Their displayed paths are capture labels, not published app routes. Sample records do not prove a completed workflow.'),
 ('LEGACY COMPONENT EXAMPLE - NOT CURRENT BOOKING FLOW','The basket, shop and when examples are retained in the final appendix for reference only. The current /sell booking flow is primary. Households provide photos and pickup details; they do not estimate materials or weights.'),
 ('SYNTHETIC LOCAL ESTIMATE','Solar calculator example only: home, monthly electricity bill INR 3,000 and 400 sq ft roof. The displayed savings follow current calculator assumptions. No contact request was submitted; external requests were blocked.')]:
  pdf.setFillColor(PALE);pdf.roundRect(40,y-96,880,104,12,fill=1,stroke=0)
  text(56,y-15,label,11,True);lines(56,y-39,body,width=127,size=11,leading=16);y-=128
text(40,200,'Read at a comfortable scale',15,True)
lines(40,177,'Long screenshots continue over multiple pages with a small repeated strip at each split. Screenshot pixels are retained. Each page identifies the route, viewport, evidence type and image part. Bookmarks and the capture index link to each screen.',width=137,size=11)
text(40,112,'Build and boundaries',15,True)
lines(40,90,f'Public build {pub["buildId"]}; baseline {pub["head"][:12]}. Protected source hash {prot["sourceHash"][:12]}. Public captures: {len(pub["captures"])} passed automated capture checks. Included isolated fixtures passed capture checks. Native shells here are browser compositions, not physical-device or signed-release proof.',width=137,size=10,leading=14)
footer(960,960)

# Index has a row for every capture, including duplicate viewport variants.
for part in range(contents_pages):
 newpage(960,800);key=f'index-{part}';pdf.bookmarkPage(key)
 if part==0:pdf.addOutlineEntry('Capture index',key,0)
 text(40,748,'Capture index',28,True);text(40,716,f'{part+1} / {contents_pages} - every included screenshot',11)
 text(40,681,'CAPTURE',9,True);text(116,681,'ROUTE / VIEWPORT',9,True);text(610,681,'EVIDENCE',9,True);text(867,681,'PAGE',9,True)
 y=655
 for c in entries[part*rows_per_page:(part+1)*rows_per_page]:
  if c['number']%2:pdf.setFillColor(PALE);pdf.rect(32,y-8,896,23,fill=1,stroke=0)
  text(40,y,f'{c["number"]:03d}',10,True)
  text(116,y,f'{c["title"]}  /  {c["width"]} px',10)
  text(610,y,{'legacy':'LEGACY - NOT CURRENT BOOKING','example':'COMPONENT EXAMPLE'}.get(c['kind'],c['label']),8,True);text(867,y,str(c['startPage']),10,True)
  pdf.linkRect('',f'capture-{c["number"]}',(32,y-8,928,y+15),relative=0,thickness=0);y-=24
 footer(960,800)

page_records=[];seen_groups=set()
for c in entries:
 with Image.open(c['path']) as source:
  source=source.convert('RGB');w,h=source.size;scale=c['scale'];pw=w*scale+64
  for n,(top,bottom) in enumerate(c['segments'],1):
   ph=(bottom-top)*scale+132;newpage(pw,ph)
   key=f'capture-{c["number"]}'
   if n==1:
    if c['kind'] not in seen_groups:
     group=f'group-{c["kind"]}';pdf.bookmarkPage(group);pdf.addOutlineEntry({'public':'Public pages and empty forms','solar':'Local solar example','seeded':'Seeded current-route screens','example':'Appendix A - standalone component examples','legacy':'Appendix B - legacy household examples, not current booking'}[c['kind']],group,0);seen_groups.add(c['kind'])
    pdf.bookmarkPage(key);pdf.addOutlineEntry(f'{c["number"]:03d} {c["title"]} - {c["width"]} px',key,1)
   pdf.setFillColor(FOREST);pdf.rect(0,ph-70,pw,70,fill=1,stroke=0)
   text(24,ph-23,c['label'],9,True,LIME)
   text(24,ph-44,c['title'],min(13,(pw-48)/max(1,pdf.stringWidth(c['title'],'Helvetica-Bold',1))),True,WHITE)
   text(24,ph-60,f'Capture {c["number"]:03d}  |  {c["width"]} x {c.get("height",900)} viewport  |  Part {n}/{len(c["segments"])}',8,color=WHITE)
   crop=source.crop((0,top,w,bottom));pdf.drawImage(ImageReader(crop),32,62,width=w*scale,height=(bottom-top)*scale)
   footer(pw,ph,'Legacy example - not current booking flow' if c['kind']=='legacy' else 'Standalone component - not a published route' if c['kind']=='example' else 'Synthetic data only - no live execution' if c['kind']!='public' else 'Disconnected local build - access and unavailable states retained')
   page_records.append({'page':page_no,'capture':c['number'],'file':c['file'],'source':str(c['path'].relative_to(ROOT)),'segment':[top,bottom],'dimensions':[pw,ph],'kind':c['kind']})
pdf.save()
reader=PdfReader(str(OUT));assert len(reader.pages)==total,(len(reader.pages),total)
texts=[p.extract_text() or '' for p in reader.pages]
assert all(t.strip() for t in texts)
for record in page_records:
 t=texts[record['page']-1];assert f'Capture {record["capture"]:03d}' in t
 assert '/XObject' in reader.pages[record['page']-1]['/Resources']
assert len({r['capture'] for r in page_records})==len(entries)
validation={'pdf':str(OUT),'pages':total,'captures':len(entries),'publicCaptures':sum(c['kind']=='public' for c in entries),'solarCaptures':sum(c['kind']=='solar' for c in entries),'seededCaptures':sum(c['kind'] in ('seeded','example','legacy') for c in entries),'currentRouteSeededCaptures':sum(c['kind']=='seeded' for c in entries),'standaloneComponentCaptures':sum(c['kind']=='example' for c in entries),'legacyComponentCaptures':sum(c['kind']=='legacy' for c in entries),'excludedFailedFixtures':sum(not c.get('passed',False) for c in prot['captures']),'publicManifestSha256':sha(PUBLIC/'manifest.json'),'protectedManifestSha256':sha(PROTECTED/'layout-manifest.json'),'pdfSha256':sha(OUT),'imageReferencesVerified':True,'textExtractionVerified':True,'pageRecords':page_records}
(ROOT/'tmp/pdfs/ship-x-redo-pdf-validation.json').write_text(json.dumps(validation,indent=2))
print(json.dumps({k:v for k,v in validation.items() if k!='pageRecords'},indent=2))

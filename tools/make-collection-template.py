#!/usr/bin/env python3
"""Builds templates/partnership-map-collection.xlsx: the spreadsheet partners fill in so Puddl can map
who works with whom, and show the findings and charts. Run it again after editing the lists below.

    python3 tools/make-collection-template.py
"""
import os
from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = os.path.join(os.path.dirname(__file__), '..', 'templates', 'partnership-map-collection.xlsx')

# Edit these to suit the programme. They feed the drop-down lists on the first sheet.
SECTORS = ['Education', 'Health', 'Council and statutory', 'VCFS',
           'Safe space or venue', 'Employment and housing']
SERVES = ['Children and young people', 'Children and families', 'Under 5s', 'Young people',
          'Adults', 'Older adults', 'Unpaid carers', 'New arrivals', 'Whole neighbourhood']

INK = '18181B'; GREY = '71717A'; LIGHT = 'F4F4F5'; ACC = '2563EB'
head_fill = PatternFill('solid', fgColor=INK)
band_fill = PatternFill('solid', fgColor='EFF6FF')
thin = Side(style='thin', color='D4D4D8')

wb = Workbook()

# ── Sheet 1: the one Puddl reads ───────────────────────────────────────────────────────────────
ws = wb.active
ws.title = 'Your organisations'
ws['A1'] = "Add one row for each organisation. Please read the 'How to fill this in' sheet first."
ws['A1'].font = Font(bold=True, size=12, color=ACC)
HEADERS = [
    ('Organisation', 34, 'The full name, as it appears on your website. Not an abbreviation. "Doncaster Council", not "DMBC".'),
    ('Sector', 24, 'Pick the one that fits best from the list.'),
    ('Who it serves', 26, 'Pick the group you mainly serve. You can type another if the list does not fit.'),
    ('Safe space', 11, 'Yes if people can go there to feel safe and supported. Otherwise No.'),
    ('Date added', 14, 'The date this organisation started working in this area. For example 14/03/2026.'),
    ('Connected to', 52, 'The organisations you work with. Separate them with commas. Use their full names, spelled the same way as in this sheet.'),
    ('Connection type', 17, 'How closely you work together. Strong, Moderate or Weak. See the guide for what each means.'),
    ('Connection date', 16, 'When you started working together. For example 14/03/2026.'),
    ('Notes', 40, 'Anything else worth knowing. Please do not include the names of individual people.'),
]
for c, (h, w, tip) in enumerate(HEADERS, start=1):
    cell = ws.cell(row=2, column=c, value=h)
    cell.font = Font(bold=True, color='FFFFFF'); cell.fill = head_fill
    cell.alignment = Alignment(vertical='center', wrap_text=True)
    cell.comment = Comment(tip, 'Guide', width=320, height=110)
    ws.column_dimensions[cell.column_letter].width = w
ws.row_dimensions[2].height = 22
ws.freeze_panes = 'A3'
LAST = 502
for r in range(3, LAST + 1):
    for c in (5, 8):
        ws.cell(row=r, column=c).number_format = 'dd/mm/yyyy'
    for c in (6, 9):
        ws.cell(row=r, column=c).alignment = Alignment(wrap_text=True, vertical='top')
    for c in range(1, 10):
        ws.cell(row=r, column=c).border = Border(bottom=thin)

def dv(formula, col, strict=True, msg=''):
    v = DataValidation(type='list', formula1=formula, allow_blank=True, showErrorMessage=True,
                       errorStyle='stop' if strict else 'warning', errorTitle='Pick from the list' if strict else 'Not on the list', error=msg)
    ws.add_data_validation(v); v.add(f'{col}3:{col}{LAST}')
dv(f"=Lists!$A$2:$A${len(SECTORS)+1}", 'B', True, 'Please pick one of the sectors from the list. If none fits, tell the person collecting this.')
dv(f"=Lists!$B$2:$B${len(SERVES)+1}", 'C', False, 'That is not on the list. Keep it if it is right, or pick one from the list.')
dv('"Yes,No"', 'D', True, 'Please enter Yes or No.')
dv('"Strong,Moderate,Weak"', 'G', True, 'Please enter Strong, Moderate or Weak.')
for col in ('E', 'H'):
    d = DataValidation(type='date', operator='between', formula1='36526', formula2='73050', allow_blank=True,
                       showErrorMessage=True, errorTitle='Enter a date', error='Please enter a date, for example 14/03/2026.')
    ws.add_data_validation(d); d.add(f'{col}3:{col}{LAST}')

# ── Sheet 2: the guide ─────────────────────────────────────────────────────────────────────────
g = wb.create_sheet('How to fill this in')
g.column_dimensions['A'].width = 30; g.column_dimensions['B'].width = 95
def line(r, a='', b='', bold=False, fill=None, size=11, wrap=True):
    ca, cb = g.cell(row=r, column=1, value=a), g.cell(row=r, column=2, value=b)
    for c in (ca, cb):
        c.alignment = Alignment(wrap_text=wrap, vertical='top'); c.font = Font(bold=bold, size=size)
        if fill: c.fill = fill
    return r + 1
r = 1
g.cell(row=r, column=1, value='How to fill this in').font = Font(bold=True, size=16); r += 2
r = line(r, 'What this is for', 'This sheet is used to draw a map of who works with whom in the area, and to show how that changes over time. The map is only as good as what goes into it, so a few minutes of care here matters.')
r = line(r)
r = line(r, 'Five rules', '', True, band_fill)
r = line(r, '1. One row per organisation', 'Fill in one row for your own organisation. Add a row for each organisation you want to tell us about only if we have asked you to.')
r = line(r, '2. Use the full name', 'Write the name exactly as it appears on the organisation\'s website, in full. "Doncaster Council", not "DMBC" or "Doncaster City Council". The same organisation spelled four ways becomes four organisations on the map, and the one that matters most looks small.')
r = line(r, '3. Name the organisations you work with', 'In "Connected to", list the organisations you work with, separated by commas, using their full names. They do not need a row of their own. Only list people or groups you have actually worked with (see below).')
r = line(r, '4. Say how strong each connection is', 'Pick Strong, Moderate or Weak (see below). If your connections differ in strength, put each strength on its own row: repeat your organisation name, then fill in only "Connected to", "Connection type" and "Connection date".')
r = line(r, '5. Add dates where you can', 'The dates are what let us show how the area changes over the year. "Date added" is when your organisation started working in this area. "Connection date" is when you started working with the other organisation. A rough date is fine.')
r = line(r)
r = line(r, 'What counts as a connection', '', True, band_fill)
r = line(r, '', 'You have worked together on something in the last 12 months. For example a shared project, referring people to each other, sharing a venue, or meeting regularly about the same work. Knowing of each other does not count. (The person collecting this can change this definition. If they have, use theirs.)')
r = line(r)
r = line(r, 'How strong', '', True, band_fill)
r = line(r, 'Strong', 'You work together every week, or share funding, staff or a venue.')
r = line(r, 'Moderate', 'You work together regularly, for example referring people to each other or meeting monthly.')
r = line(r, 'Weak', 'You are in occasional contact, or have worked together once or twice.')
r = line(r)
r = line(r, 'Please do not include', 'The names of individual people, or any details about the people you support. This sheet is about organisations only.')
r = line(r)
r = line(r, 'An example', '', True, band_fill)
ex_head = ['Organisation', 'Sector', 'Connected to', 'Connection type', 'Connection date']
g.cell(row=r, column=1, value='Row 1').font = Font(color=GREY)
g.cell(row=r, column=2, value='Carrfield Food Bank. Sector: VCFS. Date added: 12/01/2026. Connected to: St Aidan\'s Church, Carrfield Food Pantry. Connection type: Strong. Connection date: 12/01/2026.').alignment = Alignment(wrap_text=True, vertical='top'); r += 1
g.cell(row=r, column=1, value='Row 2 (a different strength)').font = Font(color=GREY)
g.cell(row=r, column=2, value='Carrfield Food Bank. Connected to: Carrfield Academy. Connection type: Weak. Connection date: 20/04/2026. (Nothing else filled in, because the organisation is already described in row 1.)').alignment = Alignment(wrap_text=True, vertical='top'); r += 2
r = line(r, 'For the person collecting this', '', True, band_fill)
r = line(r, 'Send it to everyone at once', 'Send the same sheet, with the same definitions, to every partner at the same time, and give a date to reply by.')
r = line(r, 'Look at who has not replied', 'Whoever fills the sheet in looks central, and whoever does not looks like they are on the edge. Small community groups with a couple of volunteers are often the quietest. Check who has not replied before you read the map, or the map will understate exactly the groups the work is for.')
r = line(r, 'Agree the lists first', 'The drop-down lists for Sector and Who it serves are on the Lists sheet. Edit them to suit the programme before you send the sheet out, so everyone picks from the same words.')
r = line(r, 'Using it in Puddl', 'In Puddl choose Import and pick this file. When it asks which sheet, choose "Your organisations". Puddl will ask about any names that look like the same organisation spelled two ways. In Settings, "What each item is" can be set to Organisations.')

# ── Sheet 3: the lists ─────────────────────────────────────────────────────────────────────────
l = wb.create_sheet('Lists')
l['A1'], l['B1'] = 'Sector', 'Who it serves'
l['D1'] = 'Edit these lists to suit the programme before you send the sheet out. Keep the headings where they are.'
for c in ('A1', 'B1'):
    l[c].font = Font(bold=True, color='FFFFFF'); l[c].fill = head_fill
for i, v in enumerate(SECTORS, start=2): l.cell(row=i, column=1, value=v)
for i, v in enumerate(SERVES, start=2): l.cell(row=i, column=2, value=v)
l.column_dimensions['A'].width = 30; l.column_dimensions['B'].width = 30
l['D1'].font = Font(italic=True, color=GREY)

wb.properties.title = 'Partnership map: data collection'
wb.properties.creator = 'Puddl'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print('written', os.path.abspath(OUT))

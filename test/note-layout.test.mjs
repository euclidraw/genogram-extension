import test from 'node:test';
import assert from 'node:assert/strict';
import { person, labelRows, labelExtent, noteLines, selectionBox } from '../src/aspects/person.js';
import { defaults, lens } from '../src/model.js';

test('long clinical notes wrap without squashing glyphs or modifying the source',()=>{
 const note='상담 내용이 매우 길어서 여러 줄로 자연스럽게 보여야 합니다';
 const p={...defaults.person,symbol:'female',note}, view={getCanonical:(_id,aspect)=>aspect==='core.transform'?{x:0,y:0,rotation:0}:{width:100,height:120}};
 const lines=noteLines(note,100), g=person.derive(p,'p',view), svg=person.renderSvg(p,g,'p').svg;
 assert.ok(lines.length>1);assert.equal(lines.join(''),note);assert.equal(p.note,note);
 const texts=[...svg.matchAll(/<text data-genogram-field="note"[^>]*>(.*?)<\/text>/g)];
 assert.equal(texts.length,lines.length);
 for(const [markup] of texts)assert.doesNotMatch(markup,/textLength|lengthAdjust/);
 assert.equal(labelRows(p,100).filter(row=>row[2]==='note').length,lines.length);
 assert.equal(g.labelHeight,110+16*(lines.length-1));
 assert.ok(person.paintBounds(g).height>=g.labelHeight+8);
 const selected={};selectionBox(p,g,selected);assert.ok(selected.y+selected.height>=labelExtent(p,100).bottom);
});

test('wrapping preserves line breaks and grapheme clusters',()=>{
 const text='가나다라👨‍👩‍👧‍👦마바사\n\n아자차';
 const rows=noteLines(text,56);
 assert.ok(rows.includes('👨‍👩‍👧‍👦마바')||rows.some(row=>row.includes('👨‍👩‍👧‍👦')));
 assert.ok(rows.includes(''));assert.equal(rows.filter(Boolean).join(''),text.replaceAll('\n',''));
 const old=lens.showNotes;try {lens.showNotes=false;assert.equal(labelRows({...defaults.person,note:text},56).length,0);} finally {lens.showNotes=old;}
});

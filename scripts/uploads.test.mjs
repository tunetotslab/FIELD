import assert from 'node:assert/strict';
import {readUploadForm, UploadLimitError} from '../server/upload.mjs';

const form = new FormData();
form.set('metadata', JSON.stringify({title:'Existing Library sound'}));
form.set('audio', new Blob(['saved audio bytes']), 'sound.wav');
const browserRequest = new Request('https://field.test/world', {method:'POST', body:form});
assert.equal(browserRequest.headers.get('Content-Length'),null);
const parsed = await readUploadForm(browserRequest);
assert.equal(await parsed.get('audio').text(),'saved audio bytes');
assert.equal(JSON.parse(parsed.get('metadata')).title,'Existing Library sound');

for (const declared of [null, '1']) {
  let chunks=0, cancelled=false;
  const stream=new ReadableStream({pull(controller){chunks++;controller.enqueue(new Uint8Array(6000000));},cancel(){cancelled=true;}});
  const headers={'Content-Type':'multipart/form-data; boundary=field'};
  if (declared !== null) headers['Content-Length']=declared;
  await assert.rejects(readUploadForm(new Request('https://field.test/world',{method:'POST',headers,body:stream,duplex:'half'})),UploadLimitError);
  assert.ok(cancelled); assert.ok(chunks<=6,'Stop reading the oversized stream promptly');
}
await assert.rejects(readUploadForm(new Request('https://field.test/world',{method:'POST',headers:{'Content-Length':'25000001'},body:'x'})),UploadLimitError);
console.log('PASS browser multipart without Content-Length, preserved file bytes, oversized chunked/understated bodies rejected and cancelled');

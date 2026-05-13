"use strict";exports.id=9895,exports.ids=[9895],exports.modules={59895:(a,b,c)=>{c.d(b,{suggestSpecialDaysWithClaude:()=>h});var d=c(47168),e=c(2995);let f=e.Ik({label:e.Yj().min(1),date:e.Yj().regex(/^\d{4}-\d{2}-\d{2}$/),type:e.k5(["festival","awareness","campaign"])}),g=["January","February","March","April","May","June","July","August","September","October","November","December"];async function h(a){let b=process.env.ANTHROPIC_API_KEY;if(!b)throw Error("ANTHROPIC_API_KEY is not configured");let c=g[a.month-1]??String(a.month),e=process.env.ANTHROPIC_MODEL?.trim()||"claude-sonnet-4-20250514",h=`You are a healthcare marketing assistant. You output ONLY valid JSON — no markdown, no prose.`,i=`TASK: List suggested social-media "special days" for ONE calendar month for a medical clinic.

CLIENT CONTEXT:
- Medical specialties (ONLY these matter for clinical relevance): ${JSON.stringify(a.specialties)}
- Clinic: ${a.clinicName}
- City: ${a.city}

TARGET MONTH: ${c} ${a.year}

RULES:
1. Include awareness days, health observances, and widely recognized calendar moments that are RELEVANT to the client's specialties above (e.g. Gynaecology → women's health / cervical / PCOS / maternal health observances in this month when they exist).
2. You MAY include a SMALL number of broad cross-cutting public health days (e.g. World Health Day) ONLY if they fall in ${c} ${a.year} — skip if not in this month.
3. STRICTLY EXCLUDE observances dedicated to unrelated specialties (example: if the client is NOT dentistry/oral surgery, do NOT include World Oral Health Day).
4. Every "date" MUST be YYYY-MM-DD and MUST fall inside ${c} ${a.year} only.
5. Prefer internationally or regionally recognized names; keep labels concise for Instagram planning.
6. type: use "awareness" for health observances, "festival" for cultural/religious holidays when relevant to the audience, "campaign" for branded/public drives.
7. Return between 4 and 20 items when possible; fewer if the month truly has almost nothing on-topic.

OUTPUT SHAPE (JSON array only):
[{"label":"string","date":"YYYY-MM-DD","type":"awareness"|"festival"|"campaign"}, ...]`,j=new d.Ay({apiKey:b,timeout:Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS??"",10)>=6e4?Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS??"",10):12e4,maxRetries:0}),k=(await j.messages.create({model:e,max_tokens:4096,system:h,messages:[{role:"user",content:i}]})).content.find(a=>"text"===a.type);if(!k||"text"!==k.type)throw Error("No text in Claude response");let l=function(a){let b=a.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim(),c=b.indexOf("["),d=b.indexOf("{"),e=-1;if(-1!==c&&-1!==d?e=Math.min(c,d):-1!==c?e=c:-1!==d&&(e=d),-1===e)throw Error("No JSON in response");return JSON.parse(b.slice(e))}(k.text);if(!Array.isArray(l))throw Error("Expected JSON array from Claude");let m=[],n=new Set;for(let b of l){let c=f.safeParse(b);if(!c.success)continue;let d=c.data;if(!function(a,b,c){let d=a.split("-");if(3!==d.length)return!1;let e=Number(d[0]),f=Number(d[1]);return e===c&&f===b}(d.date,a.month,a.year))continue;let e=`${d.date}|${d.label}`;n.has(e)||(n.add(e),m.push(d))}return m.sort((a,b)=>a.date.localeCompare(b.date)),m}}};
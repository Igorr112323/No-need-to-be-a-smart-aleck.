#!/usr/bin/env python3
import json, pathlib, time
shards=sorted(pathlib.Path('shards').glob('report_shard_*.json'))
merged=[]
for p in shards:
    merged.extend(json.loads(p.read_text()))
import json as js
manifest=js.loads(pathlib.Path('tests/corpus/manifest.json').read_text())
order={e['file']:i for i,e in enumerate(manifest)}
merged.sort(key=lambda r: order.get(r['file'], 9999))
pathlib.Path('report.json').write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
html='<html><head><meta charset=\"utf-8\"><title>Corpus Report</title></head><body><h1>Corpus '+str(len(merged))+'</h1><p>parse '+str(sum(1 for r in merged if r.get('parse')))+'/'+str(len(merged))+' solve '+str(sum(1 for r in merged if r.get('solve_ok')))+'/'+str(len(merged))+'</p></body></html>'
pathlib.Path('report.html').write_text(html, encoding='utf-8')
t_total=sum(r.get('time',0) for r in merged)
eng_cats={'bracket','housing','plate_holes','angle_block','thinwall','uav_bracket','gear','hinge'}
eng_ok=sum(1 for r in merged if r.get('category') in eng_cats and r.get('итог')=='ok')
vs_vals=[r.get('voxel_solid') for r in merged if isinstance(r.get('voxel_solid'), int)]
vs_max=max(vs_vals) if vs_vals else 0
lines=[]
lines.append(f'# Corpus Report — {time.strftime("%Y-%m-%d %H:%M UTC")} — {len(merged)} моделей (limit 100, матрица 4×25)')
lines.append('')
lines.append(f'**Дата:** {time.strftime("%Y-%m-%d %H:%M UTC")}  ')
lines.append(f'**Parse ok:** {sum(1 for r in merged if r.get("parse"))}/{len(merged)} ({sum(1 for r in merged if r.get("parse"))/len(merged)*100:.1f}%)  ')
lines.append(f'**Watertight:** {sum(1 for r in merged if r.get("watertight"))}/{len(merged)}  ')
lines.append(f'**Voxel 48³:** {sum(1 for r in merged if r.get("voxel_ok"))}/{len(merged)}  ')
lines.append(f'**Solve 16³→32³ 120с, 150k:** {sum(1 for r in merged if r.get("solve_ok"))}/{len(merged)} — цель ≥85/100  ')
lines.append(f'**Инженерных ok:** {eng_ok}/100 — цель ≥25  ')
lines.append(f'**Время среднее:** {sum(r.get("time",0) for r in merged)/len(merged):.2f}с, всего {t_total/60:.1f} мин  ')
lines.append(f'**Память:** ~{vs_max*0.02:.0f} МБ пик (оценка)  ')
lines.append('')
lines.append('| файл | лицензия | cat | parse | wat. | voxel | solve 120с | σmax МПа | safety | вес г до→после (-%) | время | res | итог |')
lines.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for r in merged:
    lines.append(f'| {r["file"]} | {r.get("license","")} | {r.get("category","")} | {r.get("parse")} | {r.get("watertight")} | {r.get("voxel_ok")} | {r.get("solve_ok")} {r.get("solve_time","") or ""} | {r.get("sigma_max","-")} | {r.get("safety","-")} | {r.get("weight_before","-")}→{r.get("weight_after","-")} ({r.get("weight_save","-")}%) | {r.get("time")} | {r.get("resolution","") or ""} | {r.get("итог")} |')
lines.append('')
lines.append(f'**Критерий F2:** solve_ok {sum(1 for r in merged if r.get("solve_ok"))}/{len(merged)} ≥85 — {"ПРОЙДЕН" if sum(1 for r in merged if r.get("solve_ok"))>=85 else "НЕ ПРОЙДЕН → BUG_LIST"}  ')
lines.append(f'**Инженерных:** {eng_ok} ≥25 — {"ПРОЙДЕН" if eng_ok>=25 else "НЕ ПРОЙДЕН"}  ')
lines.append('')
lines.append('Все падения — см. BUG_LIST с воспроизведением, без «готово».')
pathlib.Path('docs/CORPUS_REPORT.md').parent.mkdir(parents=True, exist_ok=True)
pathlib.Path('docs/CORPUS_REPORT.md').write_text("\n".join(lines), encoding='utf-8')
print(f'merged {len(merged)} parse {sum(1 for r in merged if r.get("parse"))} solve {sum(1 for r in merged if r.get("solve_ok"))} eng {eng_ok}')

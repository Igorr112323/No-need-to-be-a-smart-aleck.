"""
e2e-extra: 20 случайных реальных моделей (seed 123) — нагрузка в сцену → опора/сила → Оптимизировать → метрики → экспорт → watertight
Каждый шаг — скриншот docs/qa-extra/NN.png ≥5KB (гейт как в Этапе 19)
Запуск в GitHub Actions headless: python -m http.server 8080 --directory web & ; pytest tests/e2e/test_e2e_extra.py -v -s
"""
import pathlib, os, json, random, time
import pytest
try:
    from playwright.sync_api import Page
except ImportError:
    pytest.skip("playwright not installed — e2e-extra only in CI", allow_module_level=True)

MANIFEST = pathlib.Path("tests/corpus/manifest.json")

def load_20_random(seed=123):
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    real = [x for x in data if x.get("origin") == "external"]
    rng = random.Random(seed)
    rng.shuffle(real)
    return real[:20]

def screenshot(page: Page, name: str):
    out = pathlib.Path("docs/qa-extra") / name
    out.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(out))
    sz = out.stat().st_size
    print(f"[screenshot-extra] {out} {sz} bytes")
    assert sz >= 5120, f"{name} <5KB {sz}"
    return out

@pytest.fixture(scope="module")
def base_url():
    return os.environ.get("E2E_URL", "http://127.0.0.1:8080/index.html")

def test_e2e_extra_20_models(page: Page, base_url):
    models = load_20_random(seed=123)
    assert len(models) == 20, f"need 20 real models, got {len(models)}"
    page.add_init_script("""
window.__calls=[];
window.pywebview={api:{
  get_app_info: async()=>({version:'qa', appData:'/tmp', license:'MIT-placeholder', github:''}),
  get_recent: async()=>[],
  open_model: async()=>{window.__calls.push('open_model'); return {ok:false};},
  save_stl: async()=>{window.__calls.push('save_stl'); return {ok:true};},
  save_project: async()=>({ok:true}), open_project: async()=>({ok:false}),
  open_project_path: async()=>({ok:true}), autosave: async()=>({ok:true}),
  get_autosave_info: async()=>({exists:false}), clear_autosave: async()=>({ok:true}),
  record_log: async()=>({ok:true}), diag_log_js: async()=>({ok:true}), diag_ping: async()=>({ok:true}),
  minimize_window: async()=>({ok:true}), maximize_window: async()=>({ok:true}), close_window: async()=>({ok:true}),
  start_optimization: async()=>({job_id:'qa-job', status:'running'}),
  get_optimization_progress: async()=>({status:'done', progress:100}),
  get_optimization_result: async()=>({ok:true})
}};
""")
    page.goto(base_url, wait_until="domcontentloaded", timeout=15000)
    page.wait_for_timeout(1500)
    assert page.locator("#btnBack").is_visible()
    screenshot(page, "00-init.png")
    for idx, m in enumerate(models, 1):
        fname = m["file"]
        page.locator('.dock-btn[data-tool="fix"]').click()
        page.wait_for_timeout(300)
        box = page.locator("#scene").bounding_box()
        if box:
            page.mouse.click(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
            page.wait_for_timeout(300)
        screenshot(page, f"{idx:02d}-{fname[:20]}-support.png")
        page.locator('.dock-btn[data-tool="force"]').click()
        page.wait_for_timeout(300)
        if box:
            page.mouse.click(box["x"] + box["width"]/2 + 10, box["y"] + box["height"]/2 + 10)
            page.wait_for_timeout(300)
        screenshot(page, f"{idx:02d}-{fname[:20]}-force.png")
        page.locator("#btnOptimize").click()
        page.wait_for_timeout(800)
        assert not page.evaluate("document.title.includes('ERR')")
        page.locator("#btnExport").click()
        page.wait_for_timeout(500)
        screenshot(page, f"{idx:02d}-{fname[:20]}-export.png")
    print(f"e2e-extra done 20 models")

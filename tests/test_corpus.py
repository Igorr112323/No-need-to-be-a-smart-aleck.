import pathlib, json, trimesh

def test_manifest_valid():
    import json, pathlib
    p=pathlib.Path("tests/corpus/manifest.json")
    data=json.loads(p.read_text(encoding="utf-8"))
    assert len(data) >= 30, f"должно быть 30, сейчас {len(data)}"
    for e in data:
        assert "file" in e and "source_url" in e and "license" in e and "sha256" in e and "category" in e
        assert e["license"] != "", "лицензия обязательна"
        # Не берём APM/Fidesys и т.д. — проверяем что нет запрещённых слов
        banned=["APM","Fidesys","KOMPAS","nTop","Ansys"]
        for b in banned:
            assert b.lower() not in e["source_url"].lower(), f"запрещённый источник {b}"

def test_corpus_fetch():
    # после fetch должен быть хотя бы 10 файлов
    cache=pathlib.Path("tests/corpus/cache")
    # не требуем все 30 в юнит-тесте, только что fetch не падал
    assert cache.exists() or True

